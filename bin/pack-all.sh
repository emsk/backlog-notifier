#!/usr/bin/env bash
cd $(dirname $0)/..
$(yarn bin)/build --mac --win --x64
mv './dist/Backlog Notifier-0.1.0.dmg' ./dist/mac/BacklogNotifierSetup-0.1.0.dmg
mv './dist/win/Backlog Notifier Setup 0.1.0.exe' ./dist/win/BacklogNotifierSetup-0.1.0.exe
