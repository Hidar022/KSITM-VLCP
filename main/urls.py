from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),

    # ===== Auth =====
    path('register/', views.register_view, name='register'),
    path('login/', views.role_login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # ===== Dashboards =====
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('dashboard/admin/', views.dashboard_admin_view, name='dashboard_admin'),
    path('dashboard/lecturer/', views.dashboard_lecturer_view, name='dashboard_lecturer'),
    path('dashboard/student/', views.dashboard_student_view, name='dashboard_student'),

    # ===== Admin Actions =====
    path('dashboard/admin/approve/<int:user_id>/', views.approve_student, name='approve_student'),
    path('dashboard/admin/delete/<int:user_id>/', views.delete_student, name='delete_student'),
    path('dashboard/admin/add-lecturer/', views.add_lecturer_view, name='add_lecturer'),
    path('dashboard/admin/lecturers/', views.lecturers_list_view, name='lecturers_list'),
    path('dashboard/admin/export-report/<str:report>/', views.export_report, name='export_report'),
    path('dashboard/admin/reports/', views.reports_admin, name='reports_admin'),

    # ===== Courses =====
    path('courses/', views.courses, name='courses'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),

    # ===== Lecturer =====
    path('dashboard/lecturer/upload-material/', views.upload_material, name='upload_material'),
    path('dashboard/lecturer/create-assignment/', views.create_assignment, name='create_assignment'),
    path('dashboard/lecturer/chat/', views.lecturer_chat_view, name="lecturer_chat"),
    path('dashboard/lecturer/results/', views.lecturer_results_view, name="lecturer_results"),
    path('dashboard/lecturer/courses/', views.lecturer_courses_view, name='lecturer_courses'),

    # ===== Student =====
    path('dashboard/student/assignments/', views.student_assignments, name='assignments'),
    path('dashboard/student/assignment/<int:assignment_id>/', views.assignment_detail, name='assignment_detail'),

    # ===== Chat & Profile =====
    path('chat/<int:user_id>/', views.chat_view, name='chat'),
    path('profile/', views.profile_view, name='profile'),
]
