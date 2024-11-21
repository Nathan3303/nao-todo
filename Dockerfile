FROM nginx
COPY --from=docker/buildx-bin /buildx /usr/libexec/docker/cli-plugins/docker-buildx
RUN docker buildx version
COPY apps/web/dist/ /opt/web/
COPY nginx/ssl/ /etc/nginx/ssl/
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
