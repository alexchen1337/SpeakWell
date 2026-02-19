from sqlalchemy.orm import Session

from app.models import User


class UserDAO:
    def get_by_id(self, db: Session, user_id: str) -> User | None:
        return db.query(User).filter(User.id == user_id).first()

    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email).first()

    def get_by_identity_provider_id(self, db: Session, provider_id: str) -> User | None:
        return db.query(User).filter(User.identity_provider_id == provider_id).first()

    def create(self, db: Session, user: User) -> User:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def update_name(self, db: Session, user: User, name: str) -> User:
        user.name = name
        db.commit()
        db.refresh(user)
        return user

    def update_role(self, db: Session, user: User, role: str) -> User:
        user.role = role
        db.commit()
        db.refresh(user)
        return user

    def get_by_ids(self, db: Session, user_ids: list[str]) -> list[User]:
        if not user_ids:
            return []
        return db.query(User).filter(User.id.in_(user_ids)).all()


user_dao = UserDAO()
