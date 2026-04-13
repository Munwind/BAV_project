import json
import os
import re
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()


def require_env(names: str | tuple[str, ...], default: str | None = None) -> str:
    if isinstance(names, str):
        names = (names,)

    for name in names:
        value = os.getenv(name)
        if value:
            return value

    if default:
        return default

    raise RuntimeError(f"Missing required environment variable: {', '.join(names)}")


OPENAI_API_KEY = require_env(("OPENAI_API_KEY", "OPEN_API_KEY"))
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL")
DEFAULT_MODEL = "openai/gpt-oss-120b" if OPENAI_API_KEY.startswith("nvapi-") else "gpt-4.1-mini"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)
NER_API_KEY = os.getenv("NVIDIA_API_OSS_20b") or OPENAI_API_KEY
NER_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1") if NER_API_KEY.startswith("nvapi-") else OPENAI_BASE_URL
NER_MODEL = os.getenv("NVIDIA_NER_MODEL", "openai/gpt-oss-20b") if NER_API_KEY.startswith("nvapi-") else OPENAI_MODEL
NER_MAX_TOKENS = int(os.getenv("NVIDIA_NER_MAX_TOKENS", "220"))
NER_TEMPERATURE = float(os.getenv("NVIDIA_NER_TEMPERATURE", "0"))
NER_TOP_P = float(os.getenv("NVIDIA_NER_TOP_P", "1"))
NER_SEED = int(os.getenv("NVIDIA_NER_SEED", "7"))
NER_DEBUG_ENABLED = os.getenv("AI_NER_DEBUG_ENABLED", "false").lower() == "true"
AI_SERVICE_NAME = os.getenv("AI_SERVICE_NAME", "sentimentx-ai")
AI_REASONING_EFFORT = os.getenv("AI_REASONING_EFFORT", "low")

if not OPENAI_BASE_URL and OPENAI_API_KEY.startswith("nvapi-"):
    OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1"

chat_client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
ner_client = OpenAI(api_key=NER_API_KEY, base_url=NER_BASE_URL)
app = FastAPI(title=AI_SERVICE_NAME)


def log_ner_event(mode: str, text: str, companies: list[dict[str, Any]] | None = None, errors: list[str] | None = None) -> None:
    payload = {
        "event": "ner_extract",
        "mode": mode,
        "input_preview": text[:120],
        "company_count": len(companies or []),
        "errors": errors or [],
    }
    print(json.dumps(payload, ensure_ascii=False))


class Article(BaseModel):
    id: int | None = None
    source_key: str | None = None
    source_name: str | None = None
    title: str
    description_text: str | None = None
    article_url: str | None = None
    author_name: str | None = None
    published_at: str | None = None


class ChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=4000)
    articles: list[Article] = Field(default_factory=list)
    locale: str = "vi-VN"
    model: str | None = None
    retrieval_context: dict[str, Any] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list)


class NerRequest(BaseModel):
    text: str = Field(min_length=3, max_length=8000)
    locale: str = "vi-VN"
    model: str | None = None


class ArticleNerRequest(BaseModel):
    title: str = Field(default="", max_length=4000)
    description_text: str = Field(default="", max_length=8000)
    locale: str = "vi-VN"
    model: str | None = None


class NerDebugRequest(BaseModel):
    text: str = Field(default="", max_length=8000)
    title: str = Field(default="", max_length=4000)
    description_text: str = Field(default="", max_length=8000)
    locale: str = "vi-VN"
    model: str | None = None
    mode: str = "text"


def build_article_context(articles: list[Article]) -> str:
    if articles is None:
        return "Khong co ngu canh bai viet."

    if not articles:
        return "Khong co bai viet nao khop truc tiep voi bo loc hien tai. Hay tra loi trung lap va neu ro day la gioi han du lieu."

    serialized_articles: list[dict[str, Any]] = []
    for article in articles[:12]:
        serialized_articles.append(
            {
                "title": article.title,
                "source": article.source_name,
                "published_at": article.published_at,
                "summary": article.description_text,
                "url": article.article_url,
            }
        )

    return json.dumps(serialized_articles, ensure_ascii=False, indent=2)


def build_retrieval_summary(retrieval_context: dict[str, Any]) -> str:
    if not retrieval_context:
        return "Khong co metadata truy van bo sung."

    lines: list[str] = []
    context_mode = retrieval_context.get("contextMode")
    interaction_mode = retrieval_context.get("interactionMode")
    company_name = retrieval_context.get("companyName")
    requested_date = retrieval_context.get("requestedDate")
    matched_articles = retrieval_context.get("matchedArticles")

    if interaction_mode == "smalltalk":
        lines.append("Loai tuong tac: chao hoi hoac dieu huong ngan, khong can trich dan bai viet.")
    else:
        lines.append("Loai tuong tac: phan tich dua tren du lieu bai viet.")

    if context_mode == "company" and company_name:
        lines.append(f"Ngu canh uu tien: doanh nghiep {company_name}.")
    else:
        lines.append("Ngu canh uu tien: toan canh dashboard hoac thi truong.")

    if requested_date:
        lines.append(f"Ngay duoc hoi: {requested_date}.")

    if matched_articles is not None:
        lines.append(f"So bai viet khop bo loc: {matched_articles}.")

    return "\n".join(lines)


def build_history_context(history: list[dict[str, str]]) -> str:
    if not history:
        return "Chua co lich su hoi thoai truoc do."

    lines: list[str] = []
    for item in history[-8:]:
        role = "Nguoi dung" if item.get("role") == "user" else "Assistant"
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{role}: {content}")

    return "\n".join(lines) if lines else "Chua co lich su hoi thoai truoc do."


def extract_text(response: Any) -> str:
    output_text = getattr(response, "output_text", "")
    if output_text:
        return output_text.strip()

    chunks: list[str] = []
    for item in getattr(response, "output", []) or []:
        for content in getattr(item, "content", []) or []:
            text = getattr(content, "text", None)
            if text:
                chunks.append(text)
    return "\n".join(chunks).strip()


def cleanup_answer(text: str) -> str:
    cleaned = text.replace("**", "")
    cleaned = re.sub(r"^\s*#+\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\|.*\|\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-|:]{3,}\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if not cleaned:
        raise ValueError("Empty JSON content")

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def generate_answer_with_client(
    *,
    client: OpenAI,
    base_url: str | None,
    default_model: str,
    system_prompt: str,
    user_prompt: str,
    model: str | None,
    temperature: float = 0.3,
    top_p: float = 0.9,
    max_tokens: int = 1500,
    seed: int | None = None,
) -> tuple[str, str, Any]:
    target_model = model or default_model

    if base_url and "integrate.api.nvidia.com" in base_url:
        request_payload: dict[str, Any] = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
        }
        if seed is not None:
            request_payload["seed"] = seed

        response = client.chat.completions.create(**request_payload)
        content = response.choices[0].message.content if response.choices else ""
        return cleanup_answer((content or "").strip()), target_model, getattr(response, "usage", None)

    response = client.responses.create(
        model=target_model,
        instructions=system_prompt,
        input=user_prompt,
        reasoning={"effort": AI_REASONING_EFFORT},
    )
    return cleanup_answer(extract_text(response)), getattr(response, "model", target_model), getattr(response, "usage", None)


def generate_chat_answer(system_prompt: str, user_prompt: str, model: str | None) -> tuple[str, str, Any]:
    return generate_answer_with_client(
        client=chat_client,
        base_url=OPENAI_BASE_URL,
        default_model=OPENAI_MODEL,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=0.3,
        top_p=0.9,
        max_tokens=1500,
    )


def generate_ner_answer(system_prompt: str, user_prompt: str, model: str | None) -> tuple[str, str, Any]:
    return generate_answer_with_client(
        client=ner_client,
        base_url=NER_BASE_URL,
        default_model=NER_MODEL,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        model=model,
        temperature=NER_TEMPERATURE,
        top_p=NER_TOP_P,
        max_tokens=NER_MAX_TOKENS,
        seed=NER_SEED,
    )


def build_text_ner_prompt(text: str, locale: str) -> tuple[str, str]:
    system_prompt = """
Ban la dich vu NER chuyen trich xuat ten cong ty tu cau tieng Viet hoac tieng Anh.
Yeu cau:
- Khong viet phan giai thich, khong viet reasoning, khong viet chain-of-thought.
- Tra ve nhanh va ngan gon, chi xuat duy nhat JSON.
- Chi trich xuat to chuc/doanh nghiep thuc su xuat hien ro rang trong input.
- Khong suy dien them ten cong ty khong co trong cau.
- Neu khong co doanh nghiep, tra ve mang rong.
- Tra ve DUY NHAT mot JSON object hop le theo dang:
{"companies":[{"name":"string","ticker":"string|null","aliases":["string"],"confidence":0.0}]}
- confidence nam trong khoang 0 den 1.
- aliases chi gom bien the that su xuat hien trong input.
    """.strip()

    user_prompt = f"""
Locale uu tien: {locale}
Text:
{text}
    """.strip()

    return system_prompt, user_prompt


def build_article_ner_prompt(title: str, description_text: str, locale: str) -> tuple[str, str]:
    system_prompt = """
Ban la dich vu NER cho bai bao tai chinh.
Nhiem vu:
- Khong viet phan giai thich, khong viet reasoning, khong viet chain-of-thought.
- Tra ve nhanh va ngan gon, chi xuat duy nhat JSON.
- Doc title va description cua mot bai viet.
- Trich xuat cac cong ty duoc nhac den mot cach cu the.
- Uu tien ten doanh nghiep, tap doan, ngan hang, cong ty niem yet.
- Neu nhan thay ticker chac chan trong cau, tra ve ticker.
- Khong tra ve nganh, dia danh, co quan nha nuoc, cum tu mo ho.
- Tra ve DUY NHAT mot JSON object hop le theo dang:
{"companies":[{"name":"string","ticker":"string|null","aliases":["string"],"confidence":0.0}]}
- aliases chi gom bien the xuat hien trong bai viet.
- Neu khong co cong ty ro rang, tra ve mang rong.
    """.strip()

    user_prompt = f"""
Locale uu tien: {locale}
Title:
{title}

Description:
{description_text}
    """.strip()

    return system_prompt, user_prompt


def normalize_company_candidates(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = payload.get("companies") if isinstance(payload, dict) else []
    if not isinstance(raw_items, list):
        return []

    companies: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()

    for item in raw_items[:8]:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name") or "").strip()
        ticker = str(item.get("ticker") or "").strip().upper() or None
        confidence = item.get("confidence", 0.0)

        try:
            confidence_value = max(0.0, min(float(confidence), 1.0))
        except (TypeError, ValueError):
            confidence_value = 0.0

        aliases = item.get("aliases") or []
        if not isinstance(aliases, list):
            aliases = []

        cleaned_aliases: list[str] = []
        for alias in aliases[:6]:
            alias_text = str(alias or "").strip()
            if alias_text and alias_text.lower() != name.lower() and alias_text not in cleaned_aliases:
                cleaned_aliases.append(alias_text)

        if len(name) < 2:
            continue

        key = (name.casefold(), ticker)
        if key in seen:
            continue
        seen.add(key)

        companies.append(
            {
                "name": name,
                "ticker": ticker,
                "aliases": cleaned_aliases,
                "confidence": confidence_value,
            }
        )

    return sorted(companies, key=lambda item: (-item["confidence"], item["name"]))


def build_heuristic_candidates(text: str) -> list[dict[str, Any]]:
    seen: set[tuple[str, str | None]] = set()
    companies: list[dict[str, Any]] = []

    for token in re.findall(r"\b[A-Z]{2,5}\b", text):
        key = (token.casefold(), token)
        if key in seen:
            continue
        seen.add(key)
        companies.append(
            {
                "name": token,
                "ticker": token,
                "aliases": [],
                "confidence": 0.42,
            }
        )

    for token in re.findall(r"\b[A-Z][A-Za-z]{2,20}(?:Bank|Group|Corp|Holdings|Capital|Airways|Pharma)?\b", text):
        if token.isupper():
            continue
        key = (token.casefold(), None)
        if key in seen:
            continue
        seen.add(key)
        companies.append(
            {
                "name": token,
                "ticker": None,
                "aliases": [],
                "confidence": 0.35,
            }
        )

    return companies[:6]


def extract_companies_from_text(text: str, locale: str, model: str | None) -> tuple[list[dict[str, Any]], str, Any]:
    system_prompt, user_prompt = build_text_ner_prompt(text, locale)
    answer, used_model, usage = generate_ner_answer(system_prompt, user_prompt, model)
    payload = extract_json_object(answer)
    return normalize_company_candidates(payload), used_model, usage


def extract_companies_from_article(title: str, description_text: str, locale: str, model: str | None) -> tuple[list[dict[str, Any]], str, Any]:
    system_prompt, user_prompt = build_article_ner_prompt(title, description_text, locale)
    answer, used_model, usage = generate_ner_answer(system_prompt, user_prompt, model)
    payload = extract_json_object(answer)
    return normalize_company_candidates(payload), used_model, usage


def extract_companies_with_fallback(text: str, locale: str, model: str | None) -> tuple[list[dict[str, Any]], str, Any, str]:
    errors: list[str] = []

    try:
        companies, used_model, usage = extract_companies_from_text(text, locale, model)
        log_ner_event("text", text, companies)
        return companies, used_model, usage, "text"
    except Exception as error:
        errors.append(f"text:{error}")

    try:
        companies, used_model, usage = extract_companies_from_article(text, "", locale, model)
        log_ner_event("article-fallback", text, companies, errors)
        return companies, used_model, usage, "article-fallback"
    except Exception as error:
        errors.append(f"article-fallback:{error}")

    heuristic_companies = build_heuristic_candidates(text)
    if heuristic_companies:
        log_ner_event("heuristic-fallback", text, heuristic_companies, errors)
        return heuristic_companies, model or NER_MODEL, None, "heuristic-fallback"

    log_ner_event("empty-fallback", text, [], errors)
    return [], model or NER_MODEL, None, "empty-fallback"


def extract_companies_from_article_with_fallback(
    title: str,
    description_text: str,
    locale: str,
    model: str | None,
) -> tuple[list[dict[str, Any]], str, Any, str, list[str]]:
    article_preview = f"{title.strip()} | {description_text.strip()}".strip(" |")
    combined_text = ". ".join(part for part in [title.strip(), description_text.strip()] if part)
    errors: list[str] = []

    try:
        companies, used_model, usage = extract_companies_from_article(title, description_text, locale, model)
        log_ner_event("article", article_preview, companies)
        return companies, used_model, usage, "article", errors
    except Exception as error:
        errors.append(f"article:{error}")

    if len(combined_text) >= 3:
        try:
            companies, used_model, usage = extract_companies_from_text(combined_text, locale, model)
            log_ner_event("article-text-fallback", article_preview, companies, errors)
            return companies, used_model, usage, "article-text-fallback", errors
        except Exception as error:
            errors.append(f"article-text-fallback:{error}")

        heuristic_companies = build_heuristic_candidates(combined_text)
        if heuristic_companies:
            log_ner_event("article-heuristic-fallback", article_preview, heuristic_companies, errors)
            return heuristic_companies, model or NER_MODEL, None, "article-heuristic-fallback", errors

    log_ner_event("article-empty-fallback", article_preview, [], errors)
    return [], model or NER_MODEL, None, "article-empty-fallback", errors


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": AI_SERVICE_NAME,
        "model": OPENAI_MODEL,
        "base_url": OPENAI_BASE_URL or "https://api.openai.com/v1",
        "ner_model": NER_MODEL,
        "ner_base_url": NER_BASE_URL or OPENAI_BASE_URL or "https://api.openai.com/v1",
        "ner_reasoning": "suppressed",
    }


@app.post("/ner/extract")
def ner_extract(request: NerRequest) -> dict[str, Any]:
    companies, used_model, usage, mode = extract_companies_with_fallback(request.text, request.locale, request.model)

    return {
        "companies": companies,
        "model": used_model,
        "mode": mode,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
            "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
        },
    }


@app.post("/ner/extract-article")
def ner_extract_article(request: ArticleNerRequest) -> dict[str, Any]:
    if len(request.title.strip()) < 3 and len(request.description_text.strip()) < 3:
        raise HTTPException(status_code=400, detail="Article text must be at least 3 characters long")

    companies, used_model, usage, mode, errors = extract_companies_from_article_with_fallback(
        request.title,
        request.description_text,
        request.locale,
        request.model,
    )

    return {
        "companies": companies,
        "model": used_model,
        "mode": mode,
        "errors": errors,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
            "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
        },
    }


@app.post("/ner/debug")
def ner_debug(request: NerDebugRequest) -> dict[str, Any]:
    if not NER_DEBUG_ENABLED:
        raise HTTPException(status_code=403, detail="NER debug endpoint is disabled")

    mode = request.mode.strip().lower()
    if mode not in {"text", "article"}:
        raise HTTPException(status_code=400, detail="mode must be 'text' or 'article'")

    if mode == "text":
        text = request.text.strip()
        if len(text) < 3:
            raise HTTPException(status_code=400, detail="Text must be at least 3 characters long")
        system_prompt, user_prompt = build_text_ner_prompt(text, request.locale)
    else:
        title = request.title.strip()
        description_text = request.description_text.strip()
        if len(title) < 3 and len(description_text) < 3:
            raise HTTPException(status_code=400, detail="Article text must be at least 3 characters long")
        system_prompt, user_prompt = build_article_ner_prompt(title, description_text, request.locale)

    try:
        raw_answer, used_model, usage = generate_ner_answer(system_prompt, user_prompt, request.model)
        parsed_payload = extract_json_object(raw_answer)
        normalized = normalize_company_candidates(parsed_payload)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {error}") from error

    return {
        "mode": mode,
        "model": used_model,
        "raw_answer": raw_answer,
        "parsed_payload": parsed_payload,
        "normalized_companies": normalized,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
            "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
        },
    }


@app.post("/analyze")
def analyze(request: ChatRequest) -> dict[str, Any]:
    article_context = (
        "Day la luot chao hoi hoac dieu huong ngan. Khong can trich dan bai viet hay neu gioi han du lieu."
        if request.retrieval_context.get("interactionMode") == "smalltalk"
        else build_article_context(request.articles)
    )

    system_prompt = """
Ban la tro ly AI cua SentimentX.
Yeu cau tra loi:
- Giu giong dieu trung lap, chuyen nghiep, suc tich.
- Viet tieng Viet tu nhien cho nguoi dung doanh nghiep.
- Khong dung markdown dam, khong dung bang, khong dung heading markdown, khong dung ky hieu **.
- Neu can cau truc, chi dung doan ngan hoac gach dau dong don gian.
- Uu tien thong tin co trong bai viet duoc cung cap.
- Neu truy van khong co bai viet khop, noi ro hien chua ghi nhan du lieu phu hop trong tap du lieu dang theo doi.
- Neu khong co context cong ty cu the, tra loi o muc toan canh thi truong hoac toan dashboard.
- Khong dung cac cau kieu "trong du lieu ma ban cung cap". Hay trinh bay truc tiep theo phong cach bao cao ngan.
- Khong duoc bia them su kien khong co trong du lieu.
- Neu metadata cho thay day la loi chao hoi hoac cau dieu huong ngan, hay tra loi ngan gon, lich su, khong neu gioi han du lieu va khong trich dan nguon.
    """.strip()

    user_prompt = f"""
Cau hoi cua nguoi dung:
{request.question}

Ngon ngu/locale uu tien: {request.locale}

Lich su hoi thoai:
{build_history_context(request.history)}

Metadata truy van:
{build_retrieval_summary(request.retrieval_context)}

Context bai viet:
{article_context}
""".strip()

    try:
        answer, used_model, usage = generate_chat_answer(system_prompt, user_prompt, request.model)
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {error}") from error

    if not answer:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty response")

    references = []
    if request.retrieval_context.get("interactionMode") != "smalltalk":
        references = [
            {
                "title": article.title,
                "source": article.source_name,
                "published_at": article.published_at,
                "url": article.article_url,
            }
            for article in request.articles[:5]
        ]

    return {
        "answer": answer,
        "model": used_model,
        "references": references,
        "usage": {
            "input_tokens": getattr(usage, "input_tokens", None) if usage else None,
            "output_tokens": getattr(usage, "output_tokens", None) if usage else None,
            "total_tokens": getattr(usage, "total_tokens", None) if usage else None,
        },
    }
