import React from 'react';
import ServiceAreaManager from '../../components/ServiceAreaManager';

/**
 * Service Areas Settings Page
 * Only accessible to cleaners - manage working locations
 */
export default function ServiceAreasSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Service Areas</h2>
        <p className="mt-1 text-sm text-gray-600">
          Define the locations where you offer cleaning services
        </p>
      </div>

      {/* Service Area Manager */}
      <ServiceAreaManager />
    </div>
  );
}
