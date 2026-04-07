docker login

docker tag bav_project-be:latest munwind/bav_project:be
docker tag bav_project-ai:latest munwind/bav_project:ai
docker tag bav_project-fe:latest munwind/bav_project:fe

# Push lần lượt
docker push munwind/bav_project:be
docker push munwind/bav_project:ai
docker push munwind/bav_project:fe