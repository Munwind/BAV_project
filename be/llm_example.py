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
AI_SERVICE_NAME = os.getenv("AI_SERVICE_NAME", "sentimentx-ai")
AI_REASONING_EFFORT = os.getenv("AI_REASONING_EFFORT", "low")

if not OPENAI_BASE_URL and OPENAI_API_KEY.startswith("nvapi-"):
    OPENAI_BASE_URL = "https://integrate.api.nvidia.com/v1"

client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
app = FastAPI(title=AI_SERVICE_NAME)


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


def build_article_context(articles: list[Article]) -> str:
    if articles is None:
        return "Khong co ngu canh bai viet."

    if not articles:
        return "Không có bài viết nào khớp trực tiếp với bộ lọc hiện tại. Hãy trả lời trung lập và nêu rõ đây là giới hạn dữ liệu."

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
        return "Không có metadata truy vấn bổ sung."

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
        lines.append(f"Ngữ cảnh ưu tiên: doanh nghiệp {company_name}.")
    else:
        lines.append("Ngữ cảnh ưu tiên: toàn cảnh dashboard hoặc thị trường.")

    if requested_date:
        lines.append(f"Ngày được hỏi: {requested_date}.")

    if matched_articles is not None:
        lines.append(f"Số bài viết khớp bộ lọc: {matched_articles}.")

    return "\n".join(lines)


def build_history_context(history: list[dict[str, str]]) -> str:
    if not history:
        return "Chưa có lịch sử hội thoại trước đó."

    lines: list[str] = []
    for item in history[-8:]:
        role = "Người dùng" if item.get("role") == "user" else "Assistant"
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        lines.append(f"{role}: {content}")

    return "\n".join(lines) if lines else "Chưa có lịch sử hội thoại trước đó."


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


def generate_answer(system_prompt: str, user_prompt: str, model: str | None) -> tuple[str, str, Any]:
    target_model = model or OPENAI_MODEL

    if OPENAI_BASE_URL and "integrate.api.nvidia.com" in OPENAI_BASE_URL:
        response = client.chat.completions.create(
            model=target_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            top_p=0.9,
            max_tokens=1500,
        )
        content = response.choices[0].message.content if response.choices else ""
        return cleanup_answer((content or "").strip()), target_model, getattr(response, "usage", None)

    response = client.responses.create(
        model=target_model,
        instructions=system_prompt,
        input=user_prompt,
        reasoning={"effort": AI_REASONING_EFFORT},
    )
    return cleanup_answer(extract_text(response)), getattr(response, "model", target_model), getattr(response, "usage", None)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": AI_SERVICE_NAME,
        "model": OPENAI_MODEL,
        "base_url": OPENAI_BASE_URL or "https://api.openai.com/v1",
    }


@app.post("/analyze")
def analyze(request: ChatRequest) -> dict[str, Any]:
    article_context = (
        "Day la luot chao hoi hoac dieu huong ngan. Khong can trich dan bai viet hay neu gioi han du lieu."
        if request.retrieval_context.get("interactionMode") == "smalltalk"
        else build_article_context(request.articles)
    )

    system_prompt = """
Bạn là trợ lý AI của SentimentX.
Yêu cầu trả lời:
- Giữ giọng điệu trung lập, chuyên nghiệp, súc tích.
- Viết tiếng Việt tự nhiên cho người dùng doanh nghiệp.
- Không dùng markdown đậm, không dùng bảng, không dùng heading markdown, không dùng ký hiệu **.
- Nếu cần cấu trúc, chỉ dùng đoạn ngắn hoặc gạch đầu dòng đơn giản.
- Ưu tiên thông tin có trong bài viết được cung cấp.
- Nếu truy vấn không có bài viết khớp, nói rõ hiện chưa ghi nhận dữ liệu phù hợp trong tập dữ liệu đang theo dõi.
- Nếu không có context công ty cụ thể, trả lời ở mức toàn cảnh thị trường hoặc toàn dashboard.
- Không dùng các câu kiểu "trong dữ liệu mà bạn cung cấp". Hãy trình bày trực tiếp theo phong cách báo cáo ngắn.
- Không được bịa thêm sự kiện không có trong dữ liệu.
    - Náº¿u metadata cho tháº¥y Ä‘Ã¢y lÃ  lá»i chÃ o há»i hoáº·c cÃ¢u Ä‘iá»u hÆ°á»›ng ngáº¯n, hÃ£y tráº£ lá»i ngáº¯n gá»n, lÆ°á»‹ch sá»±, khÃ´ng nÃªu giá»›i háº¡n dá»¯ liá»‡u vÃ  khÃ´ng trÃ­ch dáº«n nguá»“n.
    """.strip()

    user_prompt = f"""
Câu hỏi của người dùng:
{request.question}

Ngôn ngữ/locale ưu tiên: {request.locale}

Lịch sử hội thoại:
{build_history_context(request.history)}

Metadata truy vấn:
{build_retrieval_summary(request.retrieval_context)}

Context bài viết:
{article_context}
""".strip()

    try:
        answer, used_model, usage = generate_answer(system_prompt, user_prompt, request.model)
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
