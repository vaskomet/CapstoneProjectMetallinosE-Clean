"""
Data Preprocessing and Train/Val/Test Split for Neural Network

This management command preprocesses the extracted features and creates
train/validation/test splits ready for PyTorch training.

Usage:
    python manage.py preprocess_nn_data --input FILENAME

Steps:
1. Load feature dataset
2. Separate features, target, and metadata
3. Normalize numerical features (StandardScaler)
4. Handle outliers (optional)
5. Create stratified 80/10/10 train/val/test split
6. Save preprocessed data and scaler

Output:
- train_features.npy, train_target.npy
- val_features.npy, val_target.npy
- test_features.npy, test_target.npy
- feature_scaler.pkl
- preprocessing_config.json
"""

from django.core.management.base import BaseCommand
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import json


class Command(BaseCommand):
    help = 'Preprocess NN training data and create train/val/test splits'

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            default='nn_training_dataset_with_embeddings.csv',
            help='Input CSV with all features'
        )
        parser.add_argument(
            '--output-dir',
            type=str,
            default='nn_data',
            help='Output directory for preprocessed data'
        )
        parser.add_argument(
            '--test-size',
            type=float,
            default=0.1,
            help='Test set proportion (default: 0.1)'
        )
        parser.add_argument(
            '--val-size',
            type=float,
            default=0.1,
            help='Validation set proportion (default: 0.1)'
        )
        parser.add_argument(
            '--random-seed',
            type=int,
            default=42,
            help='Random seed for reproducibility'
        )
        parser.add_argument(
            '--remove-outliers',
            action='store_true',
            help='Remove outliers using IQR method'
        )

    def handle(self, *args, **options):
        input_file = options['input']
        output_dir = options['output_dir']
        test_size = options['test_size']
        val_size = options['val_size']
        random_seed = options['random_seed']
        remove_outliers = options['remove_outliers']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('NEURAL NETWORK DATA PREPROCESSING'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Create output directory
        import os
        os.makedirs(output_dir, exist_ok=True)
        self.stdout.write(f'\n📁 Output directory: {output_dir}')

        # Load dataset
        self.stdout.write(f'\n📊 Loading dataset from {input_file}...')
        df = pd.read_csv(input_file)
        self.stdout.write(f'   Loaded {len(df)} samples with {len(df.columns)} columns')

        # Separate features, target, and metadata
        self.stdout.write(f'\n🔍 Separating features, target, and metadata...')
        
        # Identify column types
        target_col = 'target_overall_rating'
        meta_cols = [col for col in df.columns if col.startswith('meta_')]
        feature_cols = [col for col in df.columns 
                       if col not in [target_col] + meta_cols]
        
        self.stdout.write(f'   Target variable: {target_col}')
        self.stdout.write(f'   Feature columns: {len(feature_cols)}')
        self.stdout.write(f'   Metadata columns: {len(meta_cols)}')

        # Extract features and target
        X = df[feature_cols].values
        y = df[target_col].values
        metadata = df[meta_cols]

        self.stdout.write(f'\n   Features shape: {X.shape}')
        self.stdout.write(f'   Target shape: {y.shape}')

        # Analyze target distribution
        self.stdout.write(f'\n📈 Target Distribution:')
        self.stdout.write(f'   Min: {y.min():.2f}')
        self.stdout.write(f'   Max: {y.max():.2f}')
        self.stdout.write(f'   Mean: {y.mean():.2f}')
        self.stdout.write(f'   Std: {y.std():.2f}')

        # Handle outliers if requested
        if remove_outliers:
            self.stdout.write(f'\n🔧 Removing outliers using IQR method...')
            X, y, metadata = self.remove_outliers_iqr(X, y, metadata)
            self.stdout.write(f'   Samples after outlier removal: {len(y)}')

        # Normalize target to [0, 1] range for better NN training
        self.stdout.write(f'\n⚖️  Normalizing target variable...')
        target_min = y.min()
        target_max = y.max()
        y_normalized = (y - target_min) / (target_max - target_min)
        self.stdout.write(f'   Original range: [{target_min:.2f}, {target_max:.2f}]')
        self.stdout.write(f'   Normalized range: [{y_normalized.min():.3f}, {y_normalized.max():.3f}]')

        # Create train/val/test splits
        self.stdout.write(f'\n✂️  Creating train/val/test splits...')
        self.stdout.write(f'   Random seed: {random_seed}')
        self.stdout.write(f'   Split: {1-test_size-val_size:.0%} train / {val_size:.0%} val / {test_size:.0%} test')

        # First split: separate test set
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y_normalized,
            test_size=test_size,
            random_state=random_seed,
            shuffle=True
        )

        # Second split: separate train and validation from temp
        val_size_adjusted = val_size / (1 - test_size)  # Adjust val size for remaining data
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp,
            test_size=val_size_adjusted,
            random_state=random_seed,
            shuffle=True
        )

        self.stdout.write(f'\n   Train set: {len(y_train)} samples ({len(y_train)/len(y)*100:.1f}%)')
        self.stdout.write(f'   Val set: {len(y_val)} samples ({len(y_val)/len(y)*100:.1f}%)')
        self.stdout.write(f'   Test set: {len(y_test)} samples ({len(y_test)/len(y)*100:.1f}%)')

        # Normalize features using StandardScaler (fit only on training data)
        self.stdout.write(f'\n📏 Normalizing features with StandardScaler...')
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_val_scaled = scaler.transform(X_val)
        X_test_scaled = scaler.transform(X_test)
        
        self.stdout.write(f'   ✅ Features standardized (mean=0, std=1)')

        # Save preprocessed data
        self.stdout.write(f'\n💾 Saving preprocessed data...')
        
        np.save(os.path.join(output_dir, 'train_features.npy'), X_train_scaled.astype(np.float32))
        np.save(os.path.join(output_dir, 'train_target.npy'), y_train.astype(np.float32))
        
        np.save(os.path.join(output_dir, 'val_features.npy'), X_val_scaled.astype(np.float32))
        np.save(os.path.join(output_dir, 'val_target.npy'), y_val.astype(np.float32))
        
        np.save(os.path.join(output_dir, 'test_features.npy'), X_test_scaled.astype(np.float32))
        np.save(os.path.join(output_dir, 'test_target.npy'), y_test.astype(np.float32))
        
        # Save feature scaler
        joblib.dump(scaler, os.path.join(output_dir, 'feature_scaler.pkl'))
        
        # Save preprocessing config
        config = {
            'input_file': input_file,
            'n_samples': len(y),
            'n_features': X.shape[1],
            'feature_columns': feature_cols,
            'target_column': target_col,
            'target_min': float(target_min),
            'target_max': float(target_max),
            'train_size': len(y_train),
            'val_size': len(y_val),
            'test_size': len(y_test),
            'random_seed': random_seed,
            'outliers_removed': remove_outliers,
            'train_target_mean': float(y_train.mean()),
            'train_target_std': float(y_train.std()),
        }
        
        with open(os.path.join(output_dir, 'preprocessing_config.json'), 'w') as f:
            json.dump(config, f, indent=2)
        
        self.stdout.write(f'   ✅ Saved all preprocessed files to {output_dir}/')

        # Print summary
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('PREPROCESSING COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        
        self.stdout.write(f'\n📦 Files created:')
        self.stdout.write(f'   - train_features.npy ({X_train_scaled.shape})')
        self.stdout.write(f'   - train_target.npy ({y_train.shape})')
        self.stdout.write(f'   - val_features.npy ({X_val_scaled.shape})')
        self.stdout.write(f'   - val_target.npy ({y_val.shape})')
        self.stdout.write(f'   - test_features.npy ({X_test_scaled.shape})')
        self.stdout.write(f'   - test_target.npy ({y_test.shape})')
        self.stdout.write(f'   - feature_scaler.pkl')
        self.stdout.write(f'   - preprocessing_config.json')
        
        self.stdout.write(f'\n✅ Data ready for PyTorch training!')
        self.stdout.write(f'\nNext step: Implement neural network architecture')

    def remove_outliers_iqr(self, X, y, metadata):
        """
        Remove outliers using Interquartile Range (IQR) method.
        Only applied to target variable to preserve data.
        """
        Q1 = np.percentile(y, 25)
        Q3 = np.percentile(y, 75)
        IQR = Q3 - Q1
        
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        # Find outliers
        mask = (y >= lower_bound) & (y <= upper_bound)
        n_outliers = (~mask).sum()
        
        self.stdout.write(f'   IQR bounds: [{lower_bound:.2f}, {upper_bound:.2f}]')
        self.stdout.write(f'   Outliers found: {n_outliers} ({n_outliers/len(y)*100:.2f}%)')
        
        # Keep only non-outliers
        return X[mask], y[mask], metadata[mask]
