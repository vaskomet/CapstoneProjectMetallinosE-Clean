/**
 * PhotoUpload component for before/after job photos
 * Supports drag & drop, multiple photos, and preview functionality
 */

import React, { useState, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';

const PhotoUpload = ({ 
  photoType = 'before', 
  jobId, 
  onPhotosChange, 
  maxPhotos = 5,
  disabled = false 
}) => {
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
    
    // Validate file count
    if (photos.length + fileArray.length > maxPhotos) {
      toast.warning(`Maximum ${maxPhotos} photos allowed for ${photoType} photos`);
      return;
    }

    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = fileArray.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast.error('Please select only JPEG, PNG, or WebP image files');
      return;
    }

    // Validate file sizes (max 5MB per file)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = fileArray.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Process valid files
    const newPhotos = fileArray.map(file => ({
      file,
      id: Date.now() + Math.random(),
      description: ''
    }));

    // Create previews
    const newPreviews = fileArray.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newPreviews).then(previewUrls => {
      const updatedPhotos = [...photos, ...newPhotos];
      const updatedPreviews = [...previews, ...previewUrls];
      
      setPhotos(updatedPhotos);
      setPreviews(updatedPreviews);
      
      // Notify parent component
      if (onPhotosChange) {
        onPhotosChange(updatedPhotos.map(photo => ({
          image: photo.file,
          photo_type: photoType,
          description: photo.description
        })));
      }
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e) => {
    if (disabled) return;
    handleFileSelect(e.target.files);
  };

  const removePhoto = (index) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    
    setPhotos(updatedPhotos);
    setPreviews(updatedPreviews);
    
    // Notify parent component
    if (onPhotosChange) {
      onPhotosChange(updatedPhotos.map(photo => ({
        image: photo.file,
        photo_type: photoType,
        description: photo.description
      })));
    }
  };

  const updateDescription = (index, description) => {
    const updatedPhotos = photos.map((photo, i) => 
      i === index ? { ...photo, description } : photo
    );
    
    setPhotos(updatedPhotos);
    
    // Notify parent component
    if (onPhotosChange) {
      onPhotosChange(updatedPhotos.map(photo => ({
        image: photo.file,
        photo_type: photoType,
        description: photo.description
      })));
    }
  };

  const getPhotoTypeInfo = () => {
    switch (photoType) {
      case 'before':
        return {
          title: 'Before Photos',
          description: 'Take photos showing the current state before cleaning',
          icon: '📷',
          color: 'blue'
        };
      case 'after':
        return {
          title: 'After Photos',
          description: 'Take photos showing the completed cleaning work',
          icon: '✨',
          color: 'green'
        };
      case 'progress':
        return {
          title: 'Progress Photos',
          description: 'Take photos during the cleaning process',
          icon: '🔄',
          color: 'yellow'
        };
      default:
        return {
          title: 'Photos',
          description: 'Upload photos',
          icon: '📸',
          color: 'gray'
        };
    }
  };

  const typeInfo = getPhotoTypeInfo();

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">{typeInfo.icon}</span>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{typeInfo.title}</h3>
          <p className="text-sm text-gray-600">{typeInfo.description}</p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200
          ${isDragging 
            ? `border-${typeInfo.color}-400 bg-${typeInfo.color}-50` 
            : `border-gray-300 hover:border-${typeInfo.color}-400`
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="space-y-2">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-gray-500">
            PNG, JPG, WebP up to 5MB each (max {maxPhotos} photos)
          </p>
        </div>
      </div>

      {/* Photo Previews */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">
            {photos.length} photo{photos.length !== 1 ? 's' : ''} selected
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative group">
                <div className="relative bg-white rounded-lg border border-gray-200 p-3 space-y-3">
                  {/* Image Preview */}
                  <div className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                    <img
                      src={previews[index]}
                      alt={`${photoType} photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePhoto(index);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Description Input */}
                  <textarea
                    placeholder="Add a description (optional)"
                    value={photo.description}
                    onChange={(e) => updateDescription(index, e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;