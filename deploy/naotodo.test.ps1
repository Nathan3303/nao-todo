scp -r .\apps\web\dist root@nathanspc.site:/usr/docker/jenkins_shares/naotodo
scp .\deploy\naotodo.test.conf root@nathanspc.site:/usr/docker/nginx_data/conf.d/naotodo.conf