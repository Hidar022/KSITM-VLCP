from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from django.views.decorators.http import require_POST
from django.http import HttpResponse
from django.db.models import Count
from django.db import IntegrityError
import csv, json

from .models import Profile, Course, Result, Assignment, Submission, ChatMessage, Message
from .forms import RegisterForm, RoleLoginForm
from .forms_uploads import CourseMaterialForm, AssignmentForm, StudentForm
from django.db.models import Q
from datetime import datetime
from django.views.decorators.csrf import csrf_protect


# ===================== AUTHENTICATION ===================== #

def register_view(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            department = form.cleaned_data.get('department')
            role = form.cleaned_data.get('role')

            profile, created = Profile.objects.get_or_create(user=user)
            profile.department = department
            profile.role = role
            profile.is_approved = False if role == 'lecturer' else True
            profile.save()

            messages.success(request, "Account created successfully! Please login.")
            return redirect("login")
        messages.error(request, "Fix the errors below.")
    else:
        form = RegisterForm()

    return render(request, "main/register.html", {"form": form})



@csrf_protect
def role_login_view(request):
    form = RoleLoginForm(request, data=request.POST) if request.method == "POST" else RoleLoginForm()

    if request.method == "POST" and form.is_valid():
        username = form.cleaned_data['username']
        password = form.cleaned_data['password']
        role = (form.cleaned_data.get('role') or "").strip().lower()
        lecturer_id = form.cleaned_data.get('lecturer_id') or None

        user = authenticate(username=username, password=password)
        if not user:
            form.add_error(None, "Invalid credentials.")
            return render(request, 'main/role_login.html', {'form': form})

        profile = getattr(user, "profile", None)
        if profile is None:
            form.add_error(None, "Profile missing for this user. Ask admin to fix.")
            return render(request, 'main/role_login.html', {'form': form})

        # Role check
        if (profile.role or "").strip().lower() != role:
            form.add_error(None, "Role mismatch.")
            return render(request, 'main/role_login.html', {'form': form})

        # Lecturer ID check
        if role == "lecturer":
            if not lecturer_id or str(lecturer_id).strip() != str(profile.lecturer_id):
                form.add_error(None, "Lecturer ID mismatch.")
                return render(request, 'main/role_login.html', {'form': form})

        login(request, user)
        return redirect("dashboard")

    return render(request, 'main/role_login.html', {'form': form})
@require_POST
def logout_view(request):
    logout(request)
    return redirect("login")


# ===================== DASHBOARD LOGIC ===================== #

@login_required
def dashboard_view(request):
    # Ensure we have a profile object
    profile = getattr(request.user, "profile", None)
    if profile is None:
        messages.error(request, "Profile not found. Please contact administrator.")
        # force logout or redirect to login if you prefer:
        return redirect("login")
    print("ROLE IS:", repr(profile.role))


    # normalize role to avoid capitalization mismatches
    role = (profile.role or "").strip().lower()

    # Map roles -> template names (adjust names if your templates differ)
    role_to_template = {
        "admin": "main/dashboard_admin.html",
        "lecturer": "main/dashboard_lecturer.html",
        "student": "main/dashboard_student.html",
    }

    template = role_to_template.get(role)
    if not template:
        # helpful debug message to show what's actually stored
        messages.error(request, f"Role not recognized: '{profile.role}'.")
        # optionally include more context in template
        return render(request, "main/dashboard.html", {"role": profile.role})

    # Build context per role (you can expand these as needed)
    if role == "admin":
        pending_students = Profile.objects.filter(role__iexact="student", is_approved=False)
        lecturers = Profile.objects.filter(role__iexact="lecturer")
        context = {
            "pending_students": pending_students,
            "lecturers": lecturers,
            "total_students": Profile.objects.filter(role__iexact="student").count(),
            "total_lecturers": lecturers.count(),
            "total_courses": Course.objects.count(),
            "total_assignments": Assignment.objects.count(),
        }
        return render(request, template, context)

    if role == "lecturer":
        # lecturer is stored as Profile; if your Course.lecturer FK points to Profile adjust accordingly
        courses = Course.objects.filter(lecturer=profile)
        context = {
            "courses": courses,
            "pending_assignments": Assignment.objects.filter(course__in=courses),
            "students_count": Profile.objects.filter(role__iexact="student", department=profile.department).count(),
        }
        return render(request, template, context)

    if role == "student":
        if not getattr(profile, "is_approved", True):
            return render(request, "main/not_approved.html")
        courses = Course.objects.filter(department=profile.department)
        context = {
            "courses": courses,
            "assignments": Assignment.objects.filter(course__department=profile.department),
        }
        return render(request, template, context)


# ===================== ADMIN FUNCTIONS ===================== #

@login_required
@require_POST
def approve_student(request, user_id):
    profile = get_object_or_404(Profile, user__id=user_id, role="student")
    profile.is_approved = True
    profile.save()
    messages.success(request, f"{profile.user.username} has been approved ✅")
    return redirect("dashboard_admin")


@login_required
@require_POST
def delete_lecturer(request, user_id):
    user_to_delete = User.objects.get(id=user_id)
    if user_to_delete == request.user:
        messages.error(request, "You cannot delete your own account.")
        return redirect("dashboard_admin")
    user_to_delete.delete()
    messages.success(request, "Lecturer deleted ✅")
    return redirect("dashboard_admin")


@login_required
def reports_admin(request):
    students_by_dept = Profile.objects.filter(role='student') \
        .values('department') \
        .annotate(count=Count('id')) \
        .order_by('-count')

    labels = [row['department'] for row in students_by_dept]
    data = [row['count'] for row in students_by_dept]

    return render(request, "main/reports_admin.html", {
        "labels_json": json.dumps(labels),
        "data_json": json.dumps(data),
    })


@login_required
def export_report(request, report):
    if report == 'students':
        queryset = Profile.objects.filter(role='student')
        filename = 'students_report.csv'
        headers = ['username', 'email', 'department', 'is_approved']
        rows = [(p.user.username, p.user.email, p.department, p.is_approved) for p in queryset]

    elif report == 'courses':
        queryset = Course.objects.all()
        filename = 'courses_report.csv'
        headers = ['title', 'description', 'department', 'created_at']
        rows = [(c.title, c.description, c.department, c.created_at) for c in queryset]

    else:
        return redirect("dashboard_admin")

    response = HttpResponse(content_type="text/csv")
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(headers)
    writer.writerows(rows)
    return response


# ===================== LECTURER FUNCTIONS ===================== #

@login_required
def upload_material(request):
    if request.user.profile.role != "lecturer":
        return redirect("dashboard")

    if request.method == "POST":
        form = CourseMaterialForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            messages.success(request, "Material uploaded successfully!")
            return redirect("upload_material")
    else:
        form = CourseMaterialForm()

    return render(request, "main/upload_material.html", {"form": form})


@login_required
def create_assignment(request):
    if request.user.profile.role != "lecturer":
        return redirect("dashboard")

    if request.method == "POST":
        form = AssignmentForm(request.POST)
        if form.is_valid():
            assignment = form.save(commit=False)
            assignment.lecturer = request.user
            assignment.save()
            messages.success(request, "Assignment created successfully!")
            return redirect("create_assignment")
    else:
        form = AssignmentForm()

    return render(request, "main/create_assignment.html", {"form": form})


@login_required
def lecturer_chat_view(request):
    # Lecturer sees only students
    users = User.objects.filter(profile__role="student")

    return render(request, "main/chat.html", {
        "users": users,
        "other_user": None,
        "messages": []
    })



# ===================== STUDENT FUNCTIONS ===================== #

@login_required
def student_assignments(request):
    profile = request.user.profile
    assignments = Assignment.objects.filter(course__department=profile.department)
    return render(request, "main/student_assignments.html", {"assignments": assignments})


@login_required
def assignment_detail(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    submissions = Submission.objects.filter(assignment=assignment)
    return render(request, "main/assignment_detail.html", {"assignment": assignment, "submissions": submissions})


@login_required
def submit_assignment(request, assignment_id):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    profile = request.user.profile

    if request.method == "POST":
        file = request.FILES.get("file")
        if file:
            Submission.objects.create(
                assignment=assignment,
                student=request.user,
                file=file
            )
            messages.success(request, "Assignment submitted successfully!")
            return redirect("student_assignments")
        messages.error(request, "Please upload a file before submitting.")

    return render(request, "main/submit_assignment.html", {"assignment": assignment})


# ===================== GENERAL FUNCTIONS ===================== #

def index(request):
    return render(request, 'main/index.html')


def courses(request):
    return render(request, 'main/courses.html')


@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    materials = course.materials.all()
    assignments = Assignment.objects.filter(course=course)
    return render(request, "main/course_detail.html", {
        "course": course,
        "materials": materials,
        "assignments": assignments
    })

@login_required
def chat_view(request, user_id):
    other_user = get_object_or_404(User, id=user_id)

    # Filter contacts based on roles
    if request.user.profile.role == "student":
        users = User.objects.filter(profile__role="lecturer")
    elif request.user.profile.role == "lecturer":
        users = User.objects.filter(profile__role="student")
    else:
        users = User.objects.none()

    # Load chat messages between both users
    chats = Message.objects.filter(
        sender__in=[request.user, other_user],
        receiver__in=[request.user, other_user]
    ).order_by("timestamp")

    if request.method == "POST":
        content = request.POST.get("content")
        audio = request.FILES.get("audio")
        attachment = request.FILES.get("attachment")

        if content or audio or attachment:
            Message.objects.create(
                sender=request.user,
                receiver=other_user,
                content=content,
                audio=audio,
                attachment=attachment
            )
            return redirect("chat_view", user_id=other_user.id)

    return render(request, "main/chat.html", {
        "users": users,
        "other_user": other_user,
        "messages": chats
    })



@login_required
def profile_view(request):
    return render(request, "main/profile.html")


@login_required
def lecturer_courses_view(request):
    profile = request.user.profile
    courses = Course.objects.filter(lecturer=profile)
    return render(request, 'main/lecturer_courses_section.html', {'courses': courses})

@login_required
def dashboard_admin_view(request):
    """Admin Dashboard"""
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'admin':
        return redirect('login')
    return render(request, 'main/admin_dashboard.html')


@login_required
def dashboard_lecturer_view(request):
    """Lecturer Dashboard"""
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'lecturer':
        return redirect('login')
    return render(request, 'main/lecturer_dashboard.html')


@login_required
def dashboard_student_view(request):
    """Student Dashboard"""
    if not hasattr(request.user, 'profile') or request.user.profile.role != 'student':
        return redirect('login')
    return render(request, 'main/student_dashboard.html')

@login_required
def lecturer_results_view(request):
    # Only allow lecturers to view this
    if request.user.profile.role != 'lecturer':
        return redirect('dashboard')

    # Get lecturer's courses
    courses = Course.objects.filter(lecturer=request.user.profile)

    # Get all results related to those courses
    results = Result.objects.filter(course__in=courses).select_related('student', 'course')

    context = {
        'courses': courses,
        'results': results,
    }
    return render(request, 'main/lecturer_results.html', context)

@login_required
def add_lecturer_view(request):
    if request.user.profile.role != 'admin':
        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        lecturer_id = request.POST.get('lecturer_id')
        password = request.POST.get('password')

        if User.objects.filter(username=username).exists():
            messages.error(request, "Username already exists.")
            return redirect('add_lecturer')

        if Profile.objects.filter(lecturer_id=lecturer_id).exists():
            messages.error(request, "Lecturer ID already exists.")
            return redirect('add_lecturer')

        try:
            # create a brand-new User
            user = User.objects.create_user(username=username, email=email, password=password)

            # create a Profile for that NEW user
            Profile.objects.create(user=user, role='lecturer', lecturer_id=lecturer_id)

            messages.success(request, f"Lecturer {username} added successfully!")
            return redirect('dashboard_admin')

        except IntegrityError:
            messages.error(request, "Something went wrong! User/profile might already exist.")
            return redirect('add_lecturer')

    return render(request, 'main/add_lecturer.html')


@login_required
def lecturers_list_view(request):
    if request.user.profile.role != 'admin':
        return redirect('dashboard')

    # Get all users who have a profile with role 'lecturer'
    lecturers = Profile.objects.filter(role='lecturer').select_related('user')
    
    context = {
        'lecturers': lecturers
    }
    return render(request, 'main/lecturers_list.html', context)


def add_student_view(request):
    if request.method == 'POST':
        form = StudentForm(request.POST, request.FILES)
        if form.is_valid():
            form.save()
            return redirect('students_list')  # or wherever you want it to go
    else:
        form = StudentForm()
    return render(request, 'main/add_student.html', {'form': form})

def dashboard_view(request):
    profile = request.user.profile

    if profile.role == "admin":
        return render(request, "main/dashboard_admin.html")

    elif profile.role == "lecturer":
        return render(request, "main/dashboard_lecturer.html")

    elif profile.role == "student":
        return render(request, "main/dashboard_student.html")

    else:
        return HttpResponse("Role not recognized")

