# stop docker container mynginx for reduce memory usage
docker stop mynginx

# install pnpm
npm install -g pnpm --registry=https://registry.npmmirror.com/

# install (dev)dependencies
pnpm install -w --registry=https://registry.npmmirror.com/
pnpm webapp install --registry=https://registry.npmmirror.com/

# build dist
pnpm webapp build

# remove original dist files
rm -rf /opt/shares/naotodo

# copy new dist files
cp -r apps/web/dist /opt/shares/naotodo

# start docker container mynginx
docker start mynginx