#!/usr/bin/env bash
cd $(dirname $0)/..
$(yarn bin)/electron-builder --mac --win --x64 --publish never

mv './dist/Backlog Notifier-0.1.0.dmg' ./dist/mac/BacklogNotifierSetup-0.1.0.dmg
mv './dist/Backlog Notifier-0.1.0.dmg.blockmap' ./dist/mac
mv ./dist/latest-mac.yml ./dist/mac

mkdir -p ./dist/win
mv './dist/Backlog Notifier Setup 0.1.0.exe' ./dist/win/BacklogNotifierSetup-0.1.0.exe
mv './dist/Backlog Notifier Setup 0.1.0.exe.blockmap' ./dist/win
mv ./dist/latest.yml ./dist/win
