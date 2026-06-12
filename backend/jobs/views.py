from django.http import JsonResponse
from rest_framework import viewsets


def health_check(request):
    return JsonResponse({"status": "ok"})
