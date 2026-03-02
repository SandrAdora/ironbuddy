ai-coach-app/
├── README.md
├── .env/                      # env files kept out of version control (optional)
│   ├── backend.env
│   └── frontend.env
├── backend/                   # Django + DRF API
│   ├── manage.py
│   ├── requirements.txt        
│   ├── backend/               # Django project settings
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── api/                   # Your API app (Django REST Framework)
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── migrations/
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── users/                 # (optional) auth/user app
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   └── tests/
│       └── test_api.py
├── frontend/                  # React app (Vite or CRA)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js         # or webpack config
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/               # API client wrappers
│       │   └── client.js
│       ├── components/
│       │   ├── ChatBox.jsx
│       │   └── Layout.jsx
│       ├── pages/
│       │   ├── Home.jsx
│       │   └── Login.jsx
│       ├── store/             # state (Zustand/Redux) (optional)
│       │   └── useAuthStore.js
│       └── styles/
│           └── globals.css
├── docker/                    # (optional) containerization
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── docker-compose.yml
└── scripts/                   # dev tooling
    ├── dev.sh
    └── seed.py
