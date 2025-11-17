from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

from django.urls import path, include
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('', include('main.urls')),   # <-- This makes homepage work
    path('admin/', admin.site.urls),
    path('logout/', auth_views.LogoutView.as_view(), name='site_logout'),
]

