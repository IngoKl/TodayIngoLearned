#!/bin/bash
cp db/til.db ~
git pull
pm2 restart server