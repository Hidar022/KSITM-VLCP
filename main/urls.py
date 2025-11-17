from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),

    # ===== Auth =====
    path('register/', views.register_view, name='register'),
    path('login/', views.role_login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # ===== Dashboards =====
    path('admin/dashboard/', views.dashboard_admin_view, name='dashboard_admin'),
    path('lecturer/dashboard/', views.dashboard_lecturer_view, name='dashboard_lecturer'),
    path('student/dashboard/', views.dashboard_student_view, name='dashboard_student'),

    path('dashboard/', views.dashboard_view, name='dashboard'),

    # ===== Admin Actions =====
    path('admin/approve-student/<int:user_id>/', views.approve_student, name='approve_student'),
    path('admin/delete-lecturer/<int:user_id>/', views.delete_lecturer, name='delete_lecturer'),
    path('admin/export-report/<str:report>/', views.export_report, name='export_report'),
    path('admin/reports/', views.reports_admin, name='reports_admin'),

    # ===== Courses =====
    path('courses/', views.courses, name='courses'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),

    # ===== Lecturer =====
    path('upload-material/', views.upload_material, name='upload_material'),
    path('create-assignment/', views.create_assignment, name='create_assignment'),
    path('lecturer/chat/', views.lecturer_chat_view, name="lecturer_chat"),
    path("lecturer/results/", views.lecturer_results_view, name="lecturer_results"),
    path('lecturer/courses/', views.lecturer_courses_view, name='lecturer_courses'),

    # ===== Student =====
    path('assignments/', views.student_assignments, name='assignments'),
    path('assignment/<int:assignment_id>/', views.assignment_detail, name='assignment_detail'),

    # ===== Others =====
    path('chat/<int:user_id>/', views.chat_view, name='chat'),
    path('profile/', views.profile_view, name='profile'),
    path('admin/add-lecturer/', views.add_lecturer_view, name='add_lecturer'),
    path('add-student/', views.add_student_view, name='add_student'),
    path('admin/lecturers/', views.lecturers_list_view, name='lecturers_list'),
]
