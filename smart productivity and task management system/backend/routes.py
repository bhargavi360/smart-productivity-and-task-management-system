from flask import Blueprint, request, jsonify
from database import db, bcrypt
from models import User, Task
from auth import generate_token, token_required
from datetime import datetime
import sqlalchemy

api_bp = Blueprint('api', __name__)

@api_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('email') or not data.get('password'):
        return jsonify({"message": "Missing required fields"}), 400
    
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"message": "Username already exists"}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({"message": "Email already exists"}), 400

    hashed_pw = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    new_user = User(username=data['username'], email=data['email'], password_hash=hashed_pw)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

@api_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"message": "Missing username or password"}), 400

    user = User.query.filter_by(username=data['username']).first()
    if user and bcrypt.check_password_hash(user.password_hash, data['password']):
        token = generate_token(user.id)
        return jsonify({"token": token, "user": user.to_dict()}), 200

    return jsonify({"message": "Invalid credentials"}), 401

@api_bp.route('/tasks', methods=['GET'])
@token_required
def get_tasks(current_user):
    tasks = Task.query.filter_by(user_id=current_user.id).order_by(Task.created_at.desc()).all()
    return jsonify([task.to_dict() for task in tasks]), 200

@api_bp.route('/tasks', methods=['POST'])
@token_required
def create_task(current_user):
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({"message": "Task title is required"}), 400

    deadline = None
    if data.get('deadline'):
        try:
            deadline = datetime.fromisoformat(data['deadline'])
        except ValueError:
            return jsonify({"message": "Invalid date format. Use ISO format (YYYY-MM-DD)"}), 400

    new_task = Task(
        user_id=current_user.id,
        title=data['title'],
        description=data.get('description'),
        deadline=deadline,
        priority=data.get('priority', 'Medium'),
        status='Pending'
    )
    db.session.add(new_task)
    db.session.commit()
    return jsonify(new_task.to_dict()), 201

@api_bp.route('/tasks/<int:id>', methods=['PUT'])
@token_required
def update_task(current_user, id):
    task = Task.query.filter_by(id=id, user_id=current_user.id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404

    data = request.get_json()
    if 'title' in data: task.title = data['title']
    if 'description' in data: task.description = data['description']
    if 'priority' in data: task.priority = data['priority']
    if 'status' in data: task.status = data['status']
    if 'deadline' in data:
        try:
            task.deadline = datetime.fromisoformat(data['deadline']) if data['deadline'] else None
        except ValueError:
            return jsonify({"message": "Invalid date format"}), 400

    db.session.commit()
    return jsonify(task.to_dict()), 200

@api_bp.route('/tasks/<int:id>', methods=['DELETE'])
@token_required
def delete_task(current_user, id):
    task = Task.query.filter_by(id=id, user_id=current_user.id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404
    
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200

@api_bp.route('/dashboard-stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user):
    tasks = Task.query.filter_by(user_id=current_user.id).all()
    total = len(tasks)
    completed = len([t for t in tasks if t.status == 'Completed'])
    pending = total - completed
    overdue = len([t for t in tasks if t.status == 'Pending' and t.deadline and t.deadline < datetime.utcnow()])

    # Smart Recommendation
    high_priority_pending = [t for t in tasks if t.status == 'Pending' and t.priority == 'High']
    recommendation = "All caught up! Great job."
    if overdue > 0:
        recommendation = f"You have {overdue} overdue tasks. Address them immediately!"
    elif high_priority_pending:
        recommendation = f"Focus on high priority tasks like '{high_priority_pending[0].title}' first."
    elif pending > 5:
        recommendation = "You have many pending tasks. Try breaking them into smaller steps."

    return jsonify({
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "recommendation": recommendation
    }), 200

@api_bp.route('/productivity-data', methods=['GET'])
@token_required
def get_productivity_data(current_user):
    # For simulation, we'll return some mock data based on recent tasks
    # In a real app, this would aggregate completion dates over the last week
    data = {
        "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "completion_rate": [5, 8, 3, 10, 6, 2, 4] # Number of tasks completed each day
    }
    return jsonify(data), 200
