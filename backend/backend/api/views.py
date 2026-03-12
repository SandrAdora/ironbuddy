from django.shortcuts import render

from django.contrib.auth.models import User
from rest_framework import generics 
from .serializers import UserSerializer
from rest_framework.permissions import IsAuthenticated, AllowAny 
from django.shortcuts import render

# Create your views here.
class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all() # getting all users to make sure we dont create the same user again
    serializer_class = UserSerializer # set what we need to make a user 
    permission_classes = [AllowAny]