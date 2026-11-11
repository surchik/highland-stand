#!/bin/bash
export NODE_PATH=$(npm root -g)
cd /home/user/highland-stand
D=${OUT:-/tmp/selftest-timing}; mkdir -p $D
s=$(date +%s); timeout 400 node tools/selftest.js > $D/st-single.txt 2>&1; e=$(date +%s); echo "single wall $((e-s)) s" > $D/st-times.txt
s=$(date +%s)
(timeout 400 node tools/selftest.js > $D/st-parA.txt 2>&1; echo "parA done $(( $(date +%s)-s )) s" >> $D/st-times.txt) &
(timeout 400 node tools/selftest.js > $D/st-parB.txt 2>&1; echo "parB done $(( $(date +%s)-s )) s" >> $D/st-times.txt) &
wait
echo finished >> $D/st-times.txt
