#!/bin/sh
set -eu
# Tool resolver state belongs to each container; restore even when NuGet is cached.
dotnet tool restore
exec dotnet ef "$@"
