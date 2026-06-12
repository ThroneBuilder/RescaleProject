from rest_framework import serializers
from .models import Job


class JobSerializer(serializers.ModelSerializer):
    current_status = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = ['id', 'name', 'current_status', 'created_at', 'updated_at']

    def get_current_status(self, obj):
        return getattr(obj, 'current_status', None)
