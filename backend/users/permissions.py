from rest_framework.permissions import BasePermission


class IsSchoolAdmin(BasePermission):
    """Allows access only to authenticated SCHOOL_ADMIN or SUPER_ADMIN users."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return getattr(request.user, 'role', '') in ['SCHOOL_ADMIN', 'SUPER_ADMIN']