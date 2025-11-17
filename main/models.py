from django.utils import timezone
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

DEPARTMENTS = [
    ('Computer Software Engineering', 'Computer Software Engineering'),
    ('Computer Science', 'Computer Science'),
    ('Computer Hardware Engineering', 'Computer Hardware Engineering'),
    ('Computer Engineering', 'Computer Engineering'),
    ('Accountancy', 'Accountancy'),
    ('Networking', 'Networking'),
]

class Profile(models.Model):
    ROLE_CHOICES = (
        ('student', 'Student'),
        ('lecturer', 'Lecturer'),
        ('admin', 'Admin'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    lecturer_id = models.CharField(max_length=20, blank=True, null=True)  # only for lecturers
    department = models.CharField(max_length=100, choices=DEPARTMENTS, blank=True, null=True)
    is_approved = models.BooleanField(default=False)  # approval for students

    def __str__(self):
        return f"{self.user.username} ({self.role})"

class Course(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    department = models.CharField(max_length=100, choices=DEPARTMENTS)
    lecturer = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class CourseMaterial(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="materials")
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="materials/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Assignment(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    lecturer = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        limit_choices_to={'profile__role':'lecturer'},
        null=True,    # temporarily allow null
        blank=True
    )
    course = models.ForeignKey(
        'Course',
        on_delete=models.CASCADE,
        related_name='assignments',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(default=timezone.now)  # set default instead of auto_now_add
    due_date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.title


class Submission(models.Model):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE)
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'profile__role':'student'})
    file = models.FileField(upload_to='submissions/')
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.assignment.title} - {self.student.username}"

class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField(blank=True, null=True)
    audio = models.FileField(upload_to="chat/audio/", blank=True, null=True)
    attachment = models.FileField(upload_to="chat/files/", blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("timestamp",)

    def __str__(self):
        return f"{self.sender} -> {self.receiver}"
    
class ChatMessage(models.Model):
    SENDER_CHOICES = [
        ('lecturer', 'Lecturer'),
        ('student', 'Student'),
    ]

    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    lecturer = models.ForeignKey(
        'Profile',
        on_delete=models.CASCADE,
        related_name='lecturer_messages'
    )
    student = models.ForeignKey(
        'Profile',
        on_delete=models.CASCADE,
        related_name='student_messages'
    )
    text = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='chat_files/', blank=True, null=True)
    voice_note = models.FileField(upload_to='chat_voice_notes/', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.sender} -> {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')} ({self.lecturer.user.username} <-> {self.student.user.username})"
    
class Result(models.Model):
    student = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='student_results')
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    grade = models.CharField(max_length=2, blank=True, null=True)

    def __str__(self):
        return f"{self.student.user.username} - {self.course.title} ({self.score})"



# Automatically create Profile when a User is created
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
    else:
        Profile.objects.get_or_create(user=instance)
