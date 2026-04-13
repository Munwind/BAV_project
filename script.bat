docker login

docker build -f Dockerfile.db -t bav_project-db:latest .

docker tag bav_project-db:latest munwind/bav_project:db
docker tag bav_project-be:latest munwind/bav_project:be
docker tag bav_project-ai:latest munwind/bav_project:ai
docker tag bav_project-fe:latest munwind/bav_project:fe

REM Push lan luot
docker push munwind/bav_project:db
docker push munwind/bav_project:be
docker push munwind/bav_project:ai
docker push munwind/bav_project:fe

docker pull munwind/bav_project:db
docker pull munwind/bav_project:be
docker pull munwind/bav_project:ai
docker pull munwind/bav_project:fe
