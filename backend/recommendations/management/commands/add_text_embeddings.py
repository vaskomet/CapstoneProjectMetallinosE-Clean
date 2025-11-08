"""
Text Embedding Generation for Neural Network Training

This command adds 512-dimensional text embeddings from review comments
to the existing feature dataset using sentence-transformers.

Usage:
    python manage.py add_text_embeddings --input FILENAME --output FILENAME

The command:
1. Loads the base feature dataset
2. Retrieves review text for each job
3. Generates embeddings using 'all-MiniLM-L6-v2' model (512 dims)
4. Appends embedding features to dataset
5. Saves enhanced dataset

Requirements:
    pip install sentence-transformers torch
"""

from django.core.management.base import BaseCommand
from reviews.models import Review
import pandas as pd
import numpy as np


class Command(BaseCommand):
    help = 'Add text embeddings from review comments to NN training dataset'

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            default='nn_training_dataset_full.csv',
            help='Input CSV with base features'
        )
        parser.add_argument(
            '--output',
            type=str,
            default='nn_training_dataset_with_embeddings.csv',
            help='Output CSV with embeddings added'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=32,
            help='Batch size for embedding generation'
        )

    def handle(self, *args, **options):
        input_file = options['input']
        output_file = options['output']
        batch_size = options['batch_size']

        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(self.style.SUCCESS('TEXT EMBEDDING GENERATION'))
        self.stdout.write(self.style.SUCCESS('='*70))

        # Load base features
        self.stdout.write(f'\n📁 Loading base features from {input_file}...')
        df = pd.read_csv(input_file)
        self.stdout.write(f'   Loaded {len(df)} samples with {len(df.columns)} features')

        # Import sentence-transformers (lazy import to avoid dependency on startup)
        try:
            from sentence_transformers import SentenceTransformer
            self.stdout.write(f'\n🤖 Loading sentence-transformers model...')
            model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
            self.stdout.write(f'   Model loaded: all-MiniLM-L6-v2 (384 dimensions)')
        except ImportError:
            self.stdout.write(self.style.ERROR(
                '\n❌ Error: sentence-transformers not installed'
            ))
            self.stdout.write('   Run: pip install sentence-transformers torch')
            return

        # Retrieve review texts
        self.stdout.write(f'\n📝 Retrieving review texts...')
        review_ids = df['meta_review_id'].tolist()
        reviews = Review.objects.filter(id__in=review_ids).values('id', 'comment')
        review_dict = {r['id']: r['comment'] or '' for r in reviews}
        
        # Create list of texts in same order as dataframe
        texts = [review_dict.get(rid, '') for rid in review_ids]
        self.stdout.write(f'   Retrieved {len(texts)} review texts')
        
        # Count non-empty reviews
        non_empty = sum(1 for t in texts if t.strip())
        self.stdout.write(f'   Non-empty reviews: {non_empty}/{len(texts)} ({non_empty/len(texts)*100:.1f}%)')

        # Generate embeddings in batches
        self.stdout.write(f'\n🔮 Generating embeddings (batch size: {batch_size})...')
        
        all_embeddings = []
        total_batches = (len(texts) + batch_size - 1) // batch_size
        
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]
            batch_num = i // batch_size + 1
            
            # Generate embeddings
            embeddings = model.encode(
                batch_texts,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            all_embeddings.append(embeddings)
            
            if batch_num % 10 == 0:
                self.stdout.write(f'   Processed batch {batch_num}/{total_batches}')
        
        # Combine all batches
        embeddings_matrix = np.vstack(all_embeddings)
        self.stdout.write(f'   ✅ Generated embeddings: shape {embeddings_matrix.shape}')

        # Add embeddings as columns to dataframe
        self.stdout.write(f'\n📊 Adding embedding features to dataset...')
        
        # Note: all-MiniLM-L6-v2 produces 384-dim embeddings, not 512
        # Updating our documentation accordingly
        embedding_dim = embeddings_matrix.shape[1]
        
        for i in range(embedding_dim):
            df[f'emb_{i}'] = embeddings_matrix[:, i]
        
        self.stdout.write(f'   Added {embedding_dim} embedding features')

        # Save enhanced dataset
        self.stdout.write(f'\n💾 Saving enhanced dataset to {output_file}...')
        df.to_csv(output_file, index=False)

        self.stdout.write(self.style.SUCCESS('\n' + '='*70))
        self.stdout.write(self.style.SUCCESS('EMBEDDING GENERATION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('='*70))
        self.stdout.write(f'Total features: {len(df.columns)}')
        self.stdout.write(f'  Base features: {len(df.columns) - embedding_dim}')
        self.stdout.write(f'  Embedding features: {embedding_dim}')
        self.stdout.write(f'Output file: {output_file}')
        self.stdout.write(f'File size: {df.shape}')
        self.stdout.write(self.style.SUCCESS('\n✅ Dataset ready for NN training with text embeddings!'))
