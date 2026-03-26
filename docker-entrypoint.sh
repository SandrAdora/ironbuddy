#!/bin/sh
set -e

cd /app/backend
python manage.py migrate --no-input
exec gunicorn backend.wsgi:application --bind 0.0.0.0:8000 --workers 2
