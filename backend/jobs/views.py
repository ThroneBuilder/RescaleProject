from django.db.models import OuterRef, Subquery
from django.http import JsonResponse
from rest_framework import mixins, viewsets

from .models import Job, JobStatus
from .pagination import StandardPagination
from .serializers import JobSerializer


def health_check(request):
    return JsonResponse({"status": "ok"})


class JobViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = JobSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        latest_status = (
            JobStatus.objects.filter(job=OuterRef('pk'))
            .order_by('-timestamp')
            .values('status_type')[:1]
        )
        return Job.objects.annotate(current_status=Subquery(latest_status)).order_by('-created_at')
