"""
Export training dataset to CSV file

Usage:
    python manage.py export_training_data
"""
from django.core.management.base import BaseCommand
from cleaning_jobs.models import CleaningJob
from reviews.models import Review
import csv
from pathlib import Path


class Command(BaseCommand):
    help = 'Export training dataset to CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='/app/media/training_dataset.csv',
            help='Output CSV file path'
        )

    def handle(self, *args, **options):
        output_file = options['output']
        
        self.stdout.write('Exporting training dataset to CSV...')
        
        # Get all completed jobs
        jobs = CleaningJob.objects.filter(status='completed').select_related(
            'client', 'cleaner', 'property'
        ).prefetch_related('bids', 'reviews').order_by('id')
        
        # Prepare CSV
        fieldnames = [
            'Job ID',
            'Client ID',
            'Client Email',
            'Client First Name',
            'Client Last Name',
            'Cleaner ID',
            'Cleaner Email',
            'Cleaner First Name',
            'Cleaner Last Name',
            'Property ID',
            'Property Type',
            'Property Size (sqft)',
            'Latitude',
            'Longitude',
            'Address',
            'City',
            'Scheduled Date',
            'Start Time',
            'End Time',
            'Client Budget',
            'Services Description',
            'Winning Bid Amount',
            'Bid Estimated Duration (hrs)',
            'Total Bids Received',
            'Job Status',
            'Review Overall Rating',
            'Review Comment',
            'Job Created At',
            'Job Completed At',
        ]
        
        with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            count = 0
            for job in jobs:
                # Get winning bid
                winning_bid = job.bids.filter(cleaner=job.cleaner).first() if job.cleaner else None
                
                # Get review
                review = job.reviews.first() if job.reviews.exists() else None
                
                row = {
                    'Job ID': job.id,
                    'Client ID': job.client.id,
                    'Client Email': job.client.email,
                    'Client First Name': job.client.first_name,
                    'Client Last Name': job.client.last_name,
                    'Cleaner ID': job.cleaner.id if job.cleaner else '',
                    'Cleaner Email': job.cleaner.email if job.cleaner else '',
                    'Cleaner First Name': job.cleaner.first_name if job.cleaner else '',
                    'Cleaner Last Name': job.cleaner.last_name if job.cleaner else '',
                    'Property ID': job.property.id,
                    'Property Type': job.property.property_type,
                    'Property Size (sqft)': job.property.size_sqft,
                    'Latitude': float(job.property.latitude),
                    'Longitude': float(job.property.longitude),
                    'Address': f"{job.property.address_line1}, {job.property.city}",
                    'City': job.property.city,
                    'Scheduled Date': job.scheduled_date.strftime('%Y-%m-%d') if job.scheduled_date else '',
                    'Start Time': job.start_time.strftime('%H:%M') if job.start_time else '',
                    'End Time': job.end_time.strftime('%H:%M') if job.end_time else '',
                    'Client Budget': float(job.client_budget) if job.client_budget else '',
                    'Services Description': job.services_description,
                    'Winning Bid Amount': float(winning_bid.bid_amount) if winning_bid else '',
                    'Bid Estimated Duration (hrs)': winning_bid.estimated_duration.total_seconds() / 3600 if winning_bid and winning_bid.estimated_duration else '',
                    'Total Bids Received': job.bids.count(),
                    'Job Status': job.status,
                    'Review Overall Rating': review.overall_rating if review else '',
                    'Review Comment': review.comment if review else '',
                    'Job Created At': job.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'Job Completed At': job.updated_at.strftime('%Y-%m-%d %H:%M:%S') if job.status == 'completed' else '',
                }
                
                writer.writerow(row)
                count += 1
        
        self.stdout.write(self.style.SUCCESS(f'\n✓ Exported {count} jobs to {output_file}'))
        self.stdout.write(f'  File size: {Path(output_file).stat().st_size / 1024:.1f} KB')
        
        # Also create a summary statistics file
        summary_file = output_file.replace('.csv', '_summary.txt')
        with open(summary_file, 'w') as f:
            f.write('TRAINING DATASET SUMMARY\n')
            f.write('=' * 60 + '\n\n')
            f.write(f'Total Completed Jobs: {count}\n')
            f.write(f'Total Clients: {jobs.values("client").distinct().count()}\n')
            f.write(f'Total Cleaners: {jobs.filter(cleaner__isnull=False).values("cleaner").distinct().count()}\n')
            f.write(f'Total Properties: {jobs.values("property").distinct().count()}\n')
            f.write(f'Total Bids: {sum(j.bids.count() for j in jobs)}\n')
            f.write(f'Total Reviews: {Review.objects.filter(job__in=jobs).count()}\n\n')
            
            # Property type distribution
            f.write('Property Type Distribution:\n')
            for prop_type in ['apartment', 'house', 'office', 'commercial']:
                count_type = jobs.filter(property__property_type=prop_type).count()
                pct = (count_type / count * 100) if count > 0 else 0
                f.write(f'  {prop_type.capitalize()}: {count_type} ({pct:.1f}%)\n')
            
            f.write('\n' + '=' * 60 + '\n')
        
        self.stdout.write(self.style.SUCCESS(f'✓ Summary saved to {summary_file}'))
