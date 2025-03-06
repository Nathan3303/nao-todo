# stop docker container mynginx, mynode and mymongo
docker stop mynginx mynode mymongo

# install pnpm, and install (dev)dependencies
npm install -g pnpm --registry=https://registry.npmjs.org/
pnpm install -w --registry=https://registry.npmjs.org/
pnpm webapp install --registry=https://registry.npmjs.org/

# build dist
pnpm webapp build

# remove original dist files, and copy new dist files
rm -rf /opt/shares/naotodo
cp -r apps/web/dist /opt/shares/naotodo

# start docker container mynginx, mynode and mymongo
docker start mynginx mynode mymongo

# bash into docker container mynode
docker exec -i mynode /bin/bash -c "cd /opt/shares/naotodoserver && npm install && npm run start"