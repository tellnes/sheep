#!/bin/bash

if [ $1 ]; then
  sheep-$1 --help
else

  echo "
Commands

  server
  list
  query
  host
  stable
  latest
  help
"

fi;