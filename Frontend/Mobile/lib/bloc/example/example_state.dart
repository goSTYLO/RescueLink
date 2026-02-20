import 'package:equatable/equatable.dart';

abstract class ExampleState extends Equatable {
  const ExampleState();

  @override
  List<Object> get props => [];
}

class ExampleInitial extends ExampleState {
  const ExampleInitial();
}

class ExampleLoading extends ExampleState {
  const ExampleLoading();
}

class ExampleLoaded extends ExampleState {
  final int counter;

  const ExampleLoaded(this.counter);

  @override
  List<Object> get props => [counter];
}

class ExampleError extends ExampleState {
  final String message;

  const ExampleError(this.message);

  @override
  List<Object> get props => [message];
}
