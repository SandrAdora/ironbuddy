import os
import time
import requests
from django.core.management.base import BaseCommand
from api.models import Exercise


def _youtube_video_id(exercise_name: str, api_key: str) -> str:
    """Search YouTube and return the top video ID, or '' on failure."""
    try:
        resp = requests.get(
            'https://www.googleapis.com/youtube/v3/search',
            params={
                'part': 'snippet',
                'q': f'{exercise_name} exercise tutorial',
                'type': 'video',
                'maxResults': 1,
                'key': api_key,
                'videoDuration': 'short',
            },
            timeout=10,
        )
        if not resp.ok:
            return ''
        items = resp.json().get('items', [])
        if items:
            return items[0]['id'].get('videoId', '')
    except Exception:
        pass
    return ''


def _wger_image_url(exercise_name: str) -> str:
    """Search wger for the exercise and return its main image URL, or '' on failure."""
    try:
        # Search for the exercise
        search_resp = requests.get(
            'https://wger.de/api/v2/exercise/search/',
            params={'term': exercise_name, 'language': 'english', 'format': 'json'},
            timeout=10,
        )
        if not search_resp.ok:
            return ''
        suggestions = search_resp.json().get('suggestions', [])
        if not suggestions:
            return ''
        base_id = suggestions[0].get('data', {}).get('base_id')
        if not base_id:
            return ''

        # Fetch image for this exercise
        img_resp = requests.get(
            'https://wger.de/api/v2/exerciseimage/',
            params={'exercise_base_id': base_id, 'is_main': 'true', 'format': 'json'},
            timeout=10,
        )
        if not img_resp.ok:
            return ''
        results = img_resp.json().get('results', [])
        if results:
            return results[0].get('image', '')
    except Exception:
        pass
    return ''


class Command(BaseCommand):
    help = 'Fetch YouTube video IDs and wger image URLs for all exercises'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Re-fetch even if already set')

    def handle(self, *args, **options):
        youtube_key = os.environ.get('YOUTUBE_API_KEY', '')
        if not youtube_key:
            self.stdout.write(self.style.ERROR('YOUTUBE_API_KEY not set'))
            return

        force = options['force']
        exercises = Exercise.objects.all()
        if not force:
            exercises = exercises.filter(youtube_video_id='')

        total = exercises.count()
        self.stdout.write(f'Fetching media for {total} exercises…')

        for i, ex in enumerate(exercises, 1):
            self.stdout.write(f'[{i}/{total}] {ex.name}', ending=' ')

            # YouTube
            video_id = _youtube_video_id(ex.name, youtube_key)
            ex.youtube_video_id = video_id

            # wger fallback (only if no YouTube result)
            if not video_id and not ex.wger_image_url:
                ex.wger_image_url = _wger_image_url(ex.name)

            ex.save(update_fields=['youtube_video_id', 'wger_image_url'])

            status = f'YT:{video_id or "—"}  wger:{ex.wger_image_url[:30] + "…" if ex.wger_image_url else "—"}'
            self.stdout.write(f'→ {status}')

            # Respect YouTube quota — ~1 req/sec
            time.sleep(1.2)

        self.stdout.write(self.style.SUCCESS('Done!'))
