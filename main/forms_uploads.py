from django import forms
from .models import CourseMaterial, Assignment
from .models import Profile

class CourseMaterialForm(forms.ModelForm):
    class Meta:
        model = CourseMaterial
        fields = ['course', 'title', 'file']


class AssignmentForm(forms.ModelForm):
    class Meta:
        model = Assignment
        fields = ['course', 'title', 'description', 'due_date']

class StudentForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['user', 'department']

