from django.db import transaction
from rest_framework import serializers

from .models import Job, JobStatus


class JobSerializer(serializers.ModelSerializer):
    current_status = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = ['id', 'name', 'current_status', 'created_at', 'updated_at']

    def get_current_status(self, obj):
        return getattr(obj, 'current_status', None)


class JobCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)

    @transaction.atomic
    def create(self, validated_data):
        job = Job.objects.create(name=validated_data['name'])
        JobStatus.objects.create(job=job, status_type=JobStatus.StatusType.PENDING)
        job.current_status = JobStatus.StatusType.PENDING
        return job
