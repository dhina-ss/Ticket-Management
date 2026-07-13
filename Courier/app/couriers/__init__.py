from flask import Blueprint
couriers = Blueprint('couriers', __name__)
from . import routes  # noqa
