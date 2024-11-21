FROM nginx
COPY apps/web/dist/ /opt/web/
COPY nginx/ssl/ /etc/nginx/ssl/
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
