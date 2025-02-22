# stop docker container mynginx for reduce memory usage
docker stop mynginx

# install pnpm
npm install -g pnpm --registry=https://registry.npmmirror.com/

# install (dev)dependencies
pnpm install --registry=https://registry.npmmirror.com/

# build dist
pnpm webapp:build

# remove original dist files
rm -rf /opt/shares/naotodo

# copy new dist files
cp -r apps/web/dist /opt/shares/naotodo

# start docker container mynginx
docker start mynginx

# reload deploy
#docker exec -i mynginx /bin/bash -c "deploy -s reload"

# stop original docker container
#docker stop naotodoApp

# remove original docker container
#docker rm naotodoApp

# build new docker image
#DOCKER_BUILDKIT=1 docker build -t naotodo .

# list new docker image to confirm
#docker image ls | grep naotodo

# run a new docker container by the image
#docker run -d -p 443:443 --name naotodoApp naotodo