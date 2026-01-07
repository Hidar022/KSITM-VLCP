from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User
from .models import DEPARTMENTS, Profile


class RegisterForm(UserCreationForm):
    email = forms.EmailField(required=True, widget=forms.EmailInput(attrs={
        'class': 'form-control',
        'placeholder': 'you@example.com'
    }))

    department = forms.ChoiceField(
        choices=DEPARTMENTS,
        widget=forms.Select(attrs={'class': 'form-control'})
    )

    role = forms.ChoiceField(
        choices=[('student', 'Student'), ('lecturer', 'Lecturer')],
        widget=forms.Select(attrs={'class': 'form-control'})
    )

    phone = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '+234...'
        })
    )

    photo = forms.ImageField(
        required=False,
        widget=forms.ClearableFileInput(attrs={
            'class': 'form-control'
        })
    )

    class Meta:
        model = User
        fields = (
            'username',
            'email',
            'department',
            'role',
            'phone',
            'photo',
            'password1',
            'password2',
        )

    class Meta:
        model = User
        fields = ['username', 'email', 'department', 'role', 'password1', 'password2']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Username'})
        self.fields['password1'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Password'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Confirm password'})


class LoginForm(AuthenticationForm):
    username = forms.CharField(
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter username'})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Enter password'})
    )


# ===============================
# FIXED ROLE LOGIN FORM (WORKING)
# ===============================
class RoleLoginForm(AuthenticationForm):
    role = forms.ChoiceField(
        choices=[('student','Student'), ('lecturer','Lecturer'), ('admin','Admin')],
        widget=forms.HiddenInput()
    )

    lecturer_id = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter Lecturer ID'
        })
    )

    username = forms.CharField(
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter username'
        })
    )

    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter password'
        })
    )


    class Meta:
        model = Profile
        fields = ['department']

    def save(self, commit=True):
        user = User.objects.create_user(
            username=self.cleaned_data['username'],
            email=self.cleaned_data['email'],
            password=self.cleaned_data['password']
        )
        profile = Profile.objects.create(
            user=user,
            role='lecturer',
            department=self.cleaned_data['department'],
            is_approved=True
        )
        return profile
