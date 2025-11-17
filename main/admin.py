from django.contrib import admin
from .models import Profile, Course

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'department', 'is_approved')
    list_filter = ('role', 'department', 'is_approved')
    search_fields = ('user__username', 'user__email')
    ordering = ('user__username',)


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'department', 'created_at')
    list_filter = ('department',)
    search_fields = ('title', 'description')

    

