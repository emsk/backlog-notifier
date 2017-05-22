#!/usr/bin/env bash
cd $(dirname $0)/..
$(yarn bin)/build --win --x64
mv './dist/win/Backlog Notifier Setup 0.1.0.exe' ./dist/win/BacklogNotifierSetup-0.1.0.exe
