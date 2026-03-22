#!/bin/bash
cp db/til.db ~

git pull

npm update

pm2 restart server