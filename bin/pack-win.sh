#!/usr/bin/env bash
cd $(dirname $0)/..
$(yarn bin)/electron-builder --win --x64 --publish never
mkdir -p ./dist/win
mv './dist/Backlog Notifier Setup 0.1.0.exe' ./dist/win/BacklogNotifierSetup-0.1.0.exe
mv './dist/Backlog Notifier Setup 0.1.0.exe.blockmap' ./dist/win
mv ./dist/latest.yml ./dist/win
