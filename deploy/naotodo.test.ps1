scp -r .\apps\web\dist root@pc.nathan.local:/usr/docker/jenkins_shares/naotodo
scp .\deploy\naotodo.test.conf root@pc.nathan.local:/usr/docker/nginx_data/conf.d/naotodo.conf