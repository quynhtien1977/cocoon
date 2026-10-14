#!/bin/sh
set -eu
dotnet tool restore
exec dotnet watch run --project src/Cocoon.Api --no-launch-profile --urls http://0.0.0.0:8080
