"""
WebSocket URL routing for e_clean_backend
"""
from django.urls import re_path
from chat import consumers as chat_consumers
from notifications import consumers as notification_consumers

websocket_urlpatterns = [
    # Chat WebSocket routes
    re_path(r'ws/chat/(?P<room_name>\w+)/$', chat_consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/job_chat/(?P<job_id>\d+)/$', chat_consumers.JobChatConsumer.as_asgi()),
    
    # Notification WebSocket routes
    re_path(r'ws/notifications/(?P<user_id>\d+)/$', notification_consumers.NotificationConsumer.as_asgi()),
]