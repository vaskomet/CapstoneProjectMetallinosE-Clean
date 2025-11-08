# Generated manually to handle username field properly

from django.db import migrations, models


def populate_usernames(apps, schema_editor):
    """
    Populate username field for existing users based on email.
    """
    User = apps.get_model('users', 'User')
    for user in User.objects.all():
        username_base = user.email.split('@')[0]
        username = username_base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{username_base}{counter}"
            counter += 1
        user.username = username
        user.save()


def reverse_populate_usernames(apps, schema_editor):
    """
    Reverse operation - nothing needed as we're dropping the field.
    """
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        # Add country_code field
        migrations.AddField(
            model_name='user',
            name='country_code',
            field=models.CharField(blank=True, help_text='Country code (e.g., +1, +30)', max_length=5, null=True),
        ),
        # Add username field without unique constraint first
        migrations.AddField(
            model_name='user',
            name='username',
            field=models.CharField(max_length=150, null=True, blank=True),
        ),
        # Populate usernames for existing users
        migrations.RunPython(populate_usernames, reverse_populate_usernames),
        # Now make username field unique and non-null
        migrations.AlterField(
            model_name='user',
            name='username',
            field=models.CharField(max_length=150, unique=True, db_index=True, default='temp_user'),
        ),
        # Add index for username
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['username'], name='users_user_usernam_65d164_idx'),
        ),
    ]