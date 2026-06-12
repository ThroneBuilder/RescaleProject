import random

from django.core.management.base import BaseCommand
from django.db import transaction

from jobs.models import Job, JobStatus


class Command(BaseCommand):
    help = 'Seed the database with N jobs for pagination testing'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=100, help='Number of jobs to create (default: 100)')

    def handle(self, *args, **options):
        count = options['count']
        statuses = list(JobStatus.StatusType.values)

        with transaction.atomic():
            jobs = [Job(name=f'Seed Job {i + 1}') for i in range(count)]
            created = Job.objects.bulk_create(jobs)
            JobStatus.objects.bulk_create([
                JobStatus(job=job, status_type=random.choice(statuses))
                for job in created
            ])

        self.stdout.write(self.style.SUCCESS(f'Created {count} jobs'))
