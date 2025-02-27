docker run -d \
  --name mynginx \
  -p 80:80 \
  -p 443:443 \
  -v /usr/docker/jenkins_shares/:/opt/shares/ \
  -v /usr/docker/nginx_data/:/var/nginx_home/ \
  nginx
