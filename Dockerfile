FROM node:lts-alpine as base

WORKDIR /opt

ADD package.json yarn.lock ./
ADD shared/package.json ./shared/
ADD server/package.json server/yarn.lock ./server/
ADD test/package.json test/yarn.lock ./test/
ADD web/package.json web/yarn.lock ./web/

RUN yarn install

ADD tsconfig.json tsconfig.json

WORKDIR /opt/test

ADD test .
