docker build -t bigrupai/sempeak-backend:latest -f apps/backend/Dockerfile .
docker build -t bigrupai/sempeak-web-nextjs:latest -f apps/web-nextjs/Dockerfile .
docker build -t bigrupai/sempeak-mock:latest -f apps/mock-meta-provider/Dockerfile .
 

docker push bigrupai/sempeak-backend:latest
docker push bigrupai/sempeak-web-nextjs:latest
docker push bigrupai/sempeak-mock:latest